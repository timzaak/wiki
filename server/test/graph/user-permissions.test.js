const { UserMutation } = require('../../graph/resolvers/user')

/* global WIKI */

describe('graph/user administrative mutations', () => {
  const context = { req: { user: { permissions: ['manage:users'] } } }

  beforeEach(() => {
    global.WIKI = {
      auth: {
        checkManageUserTargetAccess: jest.fn().mockResolvedValue(false),
        checkAssignUserToGroupAccess: jest.fn().mockResolvedValue(true),
        revokeUserTokens: jest.fn()
      },
      models: {
        users: {
          query: jest.fn(),
          deleteUser: jest.fn(),
          updateUser: jest.fn().mockResolvedValue({ passwordChanged: false, groupsChanged: false })
        }
      },
      events: { outbound: { emit: jest.fn() } }
    }
  })

  afterEach(() => {
    delete global.WIKI
  })

  it.each(['delete', 'update', 'verify', 'activate', 'deactivate', 'enableTFA', 'disableTFA'])(
    'rejects %s against a protected target before changing user data',
    async mutation => {
      const result = await UserMutation[mutation](null, { id: 10 }, context)
      expect(result.responseResult.succeeded).toBe(false)
      expect(WIKI.models.users.query).not.toHaveBeenCalled()
      expect(WIKI.models.users.deleteUser).not.toHaveBeenCalled()
      expect(WIKI.models.users.updateUser).not.toHaveBeenCalled()
    }
  )

  it('rejects an administrative group assignment before updating the user', async () => {
    WIKI.auth.checkManageUserTargetAccess.mockResolvedValue(true)
    WIKI.auth.checkAssignUserToGroupAccess.mockResolvedValue(false)
    const result = await UserMutation.update(null, { id: 10, groups: [1] }, context)
    expect(result.responseResult.succeeded).toBe(false)
    expect(WIKI.models.users.updateUser).not.toHaveBeenCalled()
  })

  it.each(['passwordChanged', 'groupsChanged'])('revokes existing sessions after %s', async change => {
    WIKI.auth.checkManageUserTargetAccess.mockResolvedValue(true)
    WIKI.models.users.updateUser.mockResolvedValue({ [change]: true })
    const result = await UserMutation.update(null, { id: 10 }, context)
    expect(result.responseResult.succeeded).toBe(true)
    expect(WIKI.auth.revokeUserTokens).toHaveBeenCalledWith({ id: 10, kind: 'u' })
    expect(WIKI.events.outbound.emit).toHaveBeenCalledWith('addAuthRevoke', { id: 10, kind: 'u' })
  })

  it('keeps sessions active after a non-sensitive profile update', async () => {
    WIKI.auth.checkManageUserTargetAccess.mockResolvedValue(true)
    const result = await UserMutation.update(null, { id: 10 }, context)
    expect(result.responseResult.succeeded).toBe(true)
    expect(WIKI.auth.revokeUserTokens).not.toHaveBeenCalled()
  })
})
