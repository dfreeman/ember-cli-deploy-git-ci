/* eslint-env node, es6 */
'use strict';

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const execa = require('execa');
const DeployPlugin = require('ember-cli-deploy-plugin');

module.exports = {
  name: 'ember-cli-deploy-git-ci',

  createDeployPlugin(options) {
    return new GitCIDeployPlugin(options);
  }
};

const DEFAULT_USER_NAME = 'Tomster';
const DEFAULT_USER_EMAIL = 'tomster@emberjs.com';

// ssh-add requires the key file to be private
const KEY_PERMISSIONS = 0o600;

class GitCIDeployPlugin extends DeployPlugin {
  constructor(options) {
    super(options);
    this.name = options.name;
    this.defaultConfig = {
      enabled: !!process.env.CI,
      deployKey: process.env.DEPLOY_KEY
    };
  }

  setup(context) {
    let config = context.config['git-ci'];
    if (!config.enabled) return;

    return this.determineDeployKeyPath(config)
      .then((keyPath) => this.registerDeployKey(keyPath))
      .then(() => this.configureDeployUser(config));
  }

  teardown(context) {
    let config = context.config['git-ci'];
    if (!config.enabled) return;

    // If we wrote the deploy key to a temporary path, remove it
    if (config.tempDeployKeyPath) {
      fs.unlinkSync(config.tempDeployKeyPath);
    }

    // Kill the SSH agent we started
    return execa('pkill', ['ssh-agent']);
  }

  configureDeployUser(config) {
    return Promise.all([
      this.ensureGitConfig('user.name', config.userName, DEFAULT_USER_NAME),
      this.ensureGitConfig('user.email', config.userEmail,  DEFAULT_USER_EMAIL)
    ]);
  }

  // Set the given git config value for the given key, defaulting to a fallback value
  // if no explicit one was configured and no existing value is present.
  ensureGitConfig(key, explicitValue, defaultValue) {
    let force = !!explicitValue;
    return execa('git', ['config', key])
      .then(() => force, () => true)
      .then((set) => {
        if (set) {
          return execa('git', ['config', '--global', key, explicitValue || defaultValue]);
        }
      });
  }

  // Start an SSH agent and add our deploy key, then export the socket that the
  // agent is listening on so subsequent git invocations will talk to it.
  registerDeployKey(keyPath) {
    return execa.shell(`
      eval $(ssh-agent) > /dev/null &&
      ssh-add "${keyPath}" &&
      echo $SSH_AUTH_SOCK
    `).then((result) => {
      process.env.SSH_AUTH_SOCK = result.stdout.trim();
    });
  }

  // Determine where the deploy key lives, writing an in-memory one to disk if necessary
  determineDeployKeyPath(config) {
    if (config.deployKey) {
      return this.writeDeployKey(config);
    } else {
      return this.validateDeployKey(config);
    }
  }

  // Write the given key out to a temporary location on disk
  writeDeployKey(config) {
    let keyPath = config.tempDeployKeyPath = path.join(os.tmpdir(), `deploy_key_${process.pid}`);
    return fs.writeFile(keyPath, config.deployKey, { mode: KEY_PERMISSIONS })
      .then(() => keyPath);
  }

  // Validate the given deploy key path, ensuring the key exists and has the right permissions
  validateDeployKey(config) {
    let keyPath = config.deployKeyPath;
    if (!keyPath) throw new Error('No `deployKey` or `deployKeyPath` configured; unable to deploy');

    return fs.exists(keyPath)
      .then((exists) => {
        if (!exists) throw new Error(`Unable to load deploy key at path '${keyPath}'`);
      })
      .then(() => fs.chmod(keyPath, KEY_PERMISSIONS))
      .then(() => keyPath);
  }
}
