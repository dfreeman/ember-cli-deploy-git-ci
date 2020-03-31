# ember-cli-deploy-git-ci

This is an [ember-cli-deploy](http://ember-cli.github.io/ember-cli-deploy/) plugin for managing deployments to a git branch in a CI environment like [Travis](https://travis-ci.org/).

It takes care of configuring a git user and a [deploy key](https://developer.github.com/v3/guides/managing-deploy-keys/#deploy-keys) to use when pushing your branch, but expects the actual publish to be managed by a plugin like [ember-cli-deploy-git](https://github.com/ef4/ember-cli-deploy-git).

**NEVER COMMIT YOUR DEPLOY KEY IN PLAINTEXT TO SOURCE CONTROL.** If you do, you should immediately revoke the key and generate a new one.

## Installation

`ember install ember-cli-deploy ember-cli-deploy-build ember-cli-deploy-git ember-cli-deploy-git-ci`

## Use Case

Many authors use their addon's dummy app as a way to showcase what they've built and provide documentation. [Github Pages](https://pages.github.com/) provides an easy way to host this documentation by building the app and writing the output to a `gh-pages` branch, which is exactly what [ember-cli-deploy-git](https://github.com/ef4/ember-cli-deploy-git) enables. However, this requires the author to manually deploy the app any time changes are made.

Because most CI providers use a read-only method to access code for testing, automating the process isn't as simple as adding `ember deploy` to the end of a build, since the build machine doesn't have permission to push new code to the `gh-pages` branch. Given the necessary configuration (minimally, a [deploy key](https://developer.github.com/v3/guides/managing-deploy-keys/#deploy-keys)), this plugin takes care of setting up credentials so that a CI build is able to deploy the built app when it completes.

## Configuration

In `config/deploy.js`, (which `ember-cli-deploy` will helpfully generate for you), you can pass the following options within a `git-ci` key:

 - `enabled`: whether this plugin should activate at all (defaults to true if the `CI` environment variable is set, `false` otherwise in order not to interfere with local deploys)
 - `userName`: a user name to be reflected in the deploy commit (defaults to the active `user.name` config for the local repo if present, or `Tomster` otherwise)
 - `userEmail`: a user email to be reflected in the deploy commit (defaults to the active `user.email` config for the local repo if present, or `tomster@emberjs.com` otherwise)
 - `deployKey`: the text of the SSH private key to use for deploying (defaults to the `DEPLOY_KEY` environment variable; overrides `deployKeyPath` if both are set)
 - `deployKeyPath`: the path on disk to your deploy key

An example:

```js
ENV['git-ci'] = {
  userName: 'DeployBot',
  userEmail: 'deploys@example.com',
  deployKey: process.env.SECRET_KEY
};
```

**Note**: deploy keys only work with an SSH origin for your repo, and many CI providers clone using HTTP(S) instead. You may need to explicitly set the target repo in your configuration for `ember-cli-deploy-git`. For instance, to deploy to this repository I could use:

```js
ENV['git'] = {
  repo: 'git@github.com:dfreeman/ember-cli-deploy-git-ci.git'
};
```

## Setting Up a Deploy Key

- Use [`ssh-keygen`](https://www.freebsd.org/cgi/man.cgi?query=ssh-keygen&sektion=1&manpath=OpenBSD+3.9) to generate a new public/private key pair:
  ```bash
  ssh-keygen -m PEM -t rsa -b 4096 -C "your_email@example.com" -N '' -f deploy_key
  ```
- This will produce two files in your current directory: `deploy_key` (the private key) and `deploy_key.pub` (the public key). **Do not commit these files to your repository.**
- Configure the public key with your git hosting provider. For [Github](https://developer.github.com/v3/guides/managing-deploy-keys/#deploy-keys), you can find this under the settings for your repository, at `https://github.com/<user>/<repo>/settings/keys`
- Configure the private key with your CI provider. For Travis, the simplest way to accomplish this is by using the [Travis CLI](https://github.com/travis-ci/travis.rb#installation) to set the `DEPLOY_KEY` environment variable for your repo:
  ```bash
  travis env set -- DEPLOY_KEY "$(cat deploy_key)"
  ```
