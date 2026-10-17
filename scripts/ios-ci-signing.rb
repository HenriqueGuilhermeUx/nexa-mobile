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
    raise 'No saved distribution p12 available. Recover the encrypted signing backup from the previous workflow run; do not create another Apple certificate.'
  else
    require 'base64'
    File.binwrite(p12_path, Base64.strict_decode64(b64.gsub(/\s+/, '')))
  end
  File.chmod(0600, p12_path)
  pass = ENV.fetch('IOS_DISTRIBUTION_P12_PASSWORD', '')
  raise 'Invalid distribution PKCS#12 or password' unless system('openssl', 'pkcs12', '-in', p12_path, '-passin', "pass:#{pass}", '-info', '-noout', out: File::NULL, err: File::NULL)
  raise 'Distribution PKCS#12 has no private key' unless system('sh', '-c', 'openssl pkcs12 -in "$1" -passin "pass:$2" -nocerts -nodes 2>/dev/null | grep -q "BEGIN .*PRIVATE KEY"', 'sh', p12_path, pass)
  puts 'Existing signing identity validated; no new Apple certificate issued.'

  sigh_cmd = ['fastlane', 'sigh', '--api_key_path', api_key_path,
              '--app_identifier', 'br.com.trynexa.app', '--team_id', ENV.fetch('APPLE_TEAM_ID'),
              '--output_path', out, '--filename', 'profile.mobileprovision']
  raise 'Provisioning profile generation failed' unless system(*sigh_cmd)
end
raise 'Missing provisioning profile' unless File.size?(File.join(out, 'profile.mobileprovision'))
puts 'Apple distribution certificate and provisioning profile prepared.'
