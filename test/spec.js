const exec = require('@actions/exec')
const core = require('@actions/core')
const io = require('@actions/io')
const quote = require('quote')
const sinon = require('sinon')

const npmInstall = require('../index')
const utils = npmInstall.utils

it('exports a function', () => {
  expect(npmInstall)
    .to.have.property('npmInstallAction')
    .and.be.a('function')
  expect(npmInstall).to.have.property('utils')
})

it('cache was not hit', async () => {
  // previous cache not found
  const cacheHit = false
  const restoreCache = sandbox.stub(utils, 'restoreCachedNpm')
  const install = sandbox.stub(utils, 'install')
  const saveCache = sandbox.stub(utils, 'saveCachedNpm')

  restoreCache.resolves(cacheHit)
  install.resolves()
  saveCache.resolves()

  await npmInstall.npmInstallAction()
  expect(saveCache, 'new cache was saved').to.have.been.calledOnce
  expect(
    restoreCache,
    'restore cache was checked first'
  ).to.have.been.calledBefore(install)
  expect(
    install,
    'install was called before saving cache'
  ).to.have.been.calledBefore(saveCache)
})

it('cache was hit', async () => {
  // we don't need to save cache in this case
  const cacheHit = true
  const restoreCache = sandbox.stub(utils, 'restoreCachedNpm')
  const install = sandbox.stub(utils, 'install')
  const saveCache = sandbox.stub(utils, 'saveCachedNpm')

  restoreCache.resolves(cacheHit)
  install.resolves()
  saveCache.resolves()

  await npmInstall.npmInstallAction()
  expect(install, 'install was called').to.have.been.calledOnce
  expect(saveCache, 'cache remains the same').to.have.not.been.called
  expect(
    restoreCache,
    'restore cache was checked first'
  ).to.have.been.calledBefore(install)
})

describe('install command', () => {
  beforeEach(function() {
    this.exec = sandbox.stub(exec, 'exec').resolves()
  })

  const workingDirectory = '/current/working/directory'
  const npmCacheFolder = '/path/to/user/cache'

  context('using Yarn', () => {
    const pathToYarn = '/path/to/yarn'

    it('and lock file', async function() {
      const opts = {
        useYarn: true,
        usePackageLock: true,
        workingDirectory,
        npmCacheFolder
      }
      sandbox
        .stub(io, 'which')
        .withArgs('yarn')
        .resolves(pathToYarn)
      await npmInstall.utils.install(opts)
      expect(this.exec).to.have.been.calledOnceWithExactly(
        quote(pathToYarn),
        ['--frozen-lockfile'],
        { cwd: workingDirectory }
      )
    })

    it('without lock file', async function() {
      const opts = {
        useYarn: true,
        usePackageLock: false,
        workingDirectory,
        npmCacheFolder
      }
      sandbox
        .stub(io, 'which')
        .withArgs('yarn')
        .resolves(pathToYarn)
      await npmInstall.utils.install(opts)
      expect(this.exec).to.have.been.calledOnceWithExactly(
        quote(pathToYarn),
        [],
        { cwd: workingDirectory }
      )
    })
  })

  context('using NPM', () => {
    const pathToNpm = '/path/to/npm'

    beforeEach(function() {
      this.exportVariable = sandbox.stub(core, 'exportVariable')
    })

    it('installs using lock file', async function() {
      const opts = {
        useYarn: false,
        usePackageLock: true,
        workingDirectory,
        npmCacheFolder
      }
      sandbox
        .stub(io, 'which')
        .withArgs('npm')
        .resolves(pathToNpm)
      await npmInstall.utils.install(opts)
      expect(
        this.exportVariable,
        'export npm_config_cache was called'
      ).to.be.calledOnceWithExactly('npm_config_cache', npmCacheFolder)
      expect(this.exportVariable).to.have.been.calledBefore(this.exec)
      expect(this.exec).to.have.been.calledOnceWithExactly(
        quote(pathToNpm),
        ['ci'],
        { cwd: workingDirectory }
      )
    })

    it('installs without a lock file', async function() {
      const opts = {
        useYarn: false,
        usePackageLock: false,
        workingDirectory,
        npmCacheFolder
      }
      sandbox
        .stub(io, 'which')
        .withArgs('npm')
        .resolves(pathToNpm)
      await npmInstall.utils.install(opts)
      expect(
        this.exportVariable,
        'export npm_config_cache was called'
      ).to.be.calledOnceWithExactly('npm_config_cache', npmCacheFolder)
      expect(this.exportVariable).to.have.been.calledBefore(this.exec)
      expect(this.exec).to.have.been.calledOnceWithExactly(
        quote(pathToNpm),
        ['install'],
        { cwd: workingDirectory }
      )
    })
  })
})
