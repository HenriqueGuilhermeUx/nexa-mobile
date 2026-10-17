#!/usr/bin/env ruby
require 'json'
require 'fileutils'
require 'securerandom'

out = ARGV.fetch(0)
FileUtils.mkdir_p(out)
key = ENV.fetch('APPLE_API_KEY_P8').gsub('\\n', "\n")
key = key.gsub("\r", '')
raise 'Apple API key is not PEM' unless key.include?('BEGIN PRIVATE KEY')
key_path = File.join(out, 'apple-key.p8')
File.write(key_path, key)
File.chmod(0600, key_path)
api_key_path = File.join(out, 'api-key.json')
File.write(api_key_path, JSON.generate({
  key_id: ENV.fetch('APPLE_API_KEY_ID'),
  issuer_id: ENV.fetch('APPLE_API_ISSUER_ID'),
  key: key,
  in_house: false
}))
File.chmod(0600, api_key_path)

Dir.chdir(out) do
  # Reuse an existing PKCS#12; never issue another certificate automatically.
  b64 = ENV.fetch('IOS_DISTRIBUTION_P12_BASE64', '')
  p12_path = File.join(out, 'distribution.p12')
  if b64.empty?
    # One-time issuance only. A separate explicit secret authorizes replacing the lost identity.
    raise 'Certificate issuance not authorized' unless ENV['IOS_ALLOW_NEW_CERTIFICATE'] == 'YES'
    keychain_path = File.join(out, 'nexa-ci.keychain-db')
    keychain_password = SecureRandom.hex(32)
    raise 'Keychain creation failed' unless system('security', 'create-keychain', '-p', keychain_password, keychain_path)
    raise 'Keychain unlock failed' unless system('security', 'unlock-keychain', '-p', keychain_password, keychain_path)
    system('security', 'set-keychain-settings', '-lut', '21600', keychain_path)
    cert_cmd = ['fastlane', 'cert', '--api_key_path', api_key_path, '--output_path', out,
                '--keychain_path', keychain_path, '--keychain_password', keychain_password,
                '--skip_set_partition_list', 'true']
    raise 'Certificate issuance failed' unless system(*cert_cmd)
    generated = Dir.glob(File.join(out, '*.p12')).find { |p| p != p12_path }
    raise 'Fastlane did not export a p12; stop and inspect before retrying' unless generated
    FileUtils.cp(generated, p12_path)
    # Detect the Fastlane PKCS#12 export password before using EAS.
    candidates = ['', 'password', ENV.fetch('IOS_DISTRIBUTION_P12_PASSWORD', '')].uniq
    pass = candidates.find { |candidate| system('openssl', 'pkcs12', '-in', p12_path, '-passin', "pass:#{candidate}", '-info', '-noout', out: File::NULL, err: File::NULL) }
    raise 'Generated PKCS#12 password unknown; encrypted backup will be retained' if pass.nil?
  else
    require 'base64'
    File.binwrite(p12_path, Base64.strict_decode64(b64.gsub(/\\s+/, '')))
    pass = ENV.fetch('IOS_DISTRIBUTION_P12_PASSWORD', '')
  end
  File.chmod(0600, p12_path)
  File.write(File.join(out, 'distribution-password.txt'), pass)
  File.chmod(0600, File.join(out, 'distribution-password.txt'))
  raise 'Invalid distribution PKCS#12 or password' unless system('openssl', 'pkcs12', '-in', p12_path, '-passin', "pass:#{pass}", '-info', '-noout', out: File::NULL, err: File::NULL)
  raise 'Distribution PKCS#12 has no private key' unless system('sh', '-c', 'openssl pkcs12 -in "$1" -passin "pass:$2" -nocerts -nodes 2>/dev/null | grep -q "BEGIN .*PRIVATE KEY"', 'sh', p12_path, pass)
  puts 'Signing PKCS#12 and private key validated.'
  sigh_cmd = ['fastlane', 'sigh', '--api_key_path', api_key_path,
              '--app_identifier', 'br.com.trynexa.app', '--team_id', ENV.fetch('APPLE_TEAM_ID'),
              '--output_path', out, '--filename', 'profile.mobileprovision']
  raise 'Provisioning profile generation failed' unless system(*sigh_cmd)
end
raise 'Missing provisioning profile' unless File.size?(File.join(out, 'profile.mobileprovision'))
puts 'Apple distribution certificate and provisioning profile prepared.'
