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
  # Apple distribution slots are full; never create or revoke certificates in CI.
  # Reuse an existing PKCS#12 including its private key, stored as an Actions secret.
  b64 = ENV.fetch('IOS_DISTRIBUTION_P12_BASE64', '')
  raise 'Missing IOS_DISTRIBUTION_P12_BASE64: existing distribution certificate and private key required' if b64.empty?
  require 'base64'
  p12_path = File.join(out, 'distribution.p12')
  File.binwrite(p12_path, Base64.strict_decode64(b64.gsub(/\s+/, '')))
  File.chmod(0600, p12_path)
  pass = ENV.fetch('IOS_DISTRIBUTION_P12_PASSWORD', '')
  raise 'Invalid distribution PKCS#12 or password' unless system('openssl', 'pkcs12', '-in', p12_path, '-passin', "pass:#{pass}", '-info', '-noout', out: File::NULL, err: File::NULL)

  sigh_cmd = ['fastlane', 'sigh', '--api_key_path', api_key_path,
              '--app_identifier', 'br.com.trynexa.app', '--team_id', ENV.fetch('APPLE_TEAM_ID'),
              '--output_path', out, '--filename', 'profile.mobileprovision']
  raise 'Provisioning profile generation failed' unless system(*sigh_cmd)
end
raise 'Missing provisioning profile' unless File.size?(File.join(out, 'profile.mobileprovision'))
puts 'Apple distribution certificate and provisioning profile prepared.'
