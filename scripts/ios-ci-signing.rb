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
  # The CI creates a new certificate only if Apple allows it; no revocations.
  cert_cmd = ['fastlane', 'cert', '--api_key_path', api_key_path, '--output_path', out]
  raise 'Certificate creation failed' unless system(*cert_cmd)
  p12 = Dir.glob(File.join(out, '*.p12')).first
  raise 'No distribution p12 generated' unless p12
  FileUtils.cp(p12, File.join(out, 'distribution.p12')) unless p12 == File.join(out, 'distribution.p12')
  raise 'Invalid distribution PKCS#12' unless system('openssl', 'pkcs12', '-in', File.join(out, 'distribution.p12'), '-passin', 'pass:', '-info', '-noout', out: File::NULL, err: File::NULL)

  sigh_cmd = ['fastlane', 'sigh', '--api_key_path', api_key_path,
              '--app_identifier', 'br.com.trynexa.app', '--team_id', ENV.fetch('APPLE_TEAM_ID'),
              '--output_path', out, '--filename', 'profile.mobileprovision']
  raise 'Provisioning profile generation failed' unless system(*sigh_cmd)
end
raise 'Missing provisioning profile' unless File.size?(File.join(out, 'profile.mobileprovision'))
puts 'Apple distribution certificate and provisioning profile prepared.'
