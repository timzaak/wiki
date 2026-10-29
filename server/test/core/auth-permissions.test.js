jest.mock('../../core/cache', () => ({ init: () => new Map() }))

const auth = require('../../core/auth')

describe('core/auth administrative permissions', () => {
  let groups
  let target

  beforeEach(() => {
    groups = []
    target = { id: 10, isSystem: false, getGlobalPermissions: () => [] }
    global.WIKI = {
      models: {
        groups: {
          query: () => ({ whereIn: async () => groups })
        },
        users: {
          query: () => ({
            findById: () => ({
              withGraphJoined: () => ({ modifyGraph: async () => target })
            })
          })
        }
      }
    }
  })

  afterEach(() => {
    delete global.WIKI
  })

  it.each(['manage:users', 'manage:groups'])(
    'prevents %s from assigning users to a system administrator group',
    async permission => {
      groups = [{ permissions: ['manage:system'] }]
      expect(await auth.checkAssignUserToGroupAccess({ permissions: [permission] }, [1])).toBe(false)
    }
  )

  it('checks every assigned group, including an administrative group after a content group', async () => {
    groups = [{ permissions: ['read:pages'] }, { permissions: ['manage:users'] }]
    expect(await auth.checkAssignUserToGroupAccess({ permissions: ['manage:users'] }, [3, 4])).toBe(false)
  })

  it('allows user managers to assign content groups', async () => {
    groups = [{ permissions: ['read:pages', 'write:pages'] }]
    expect(await auth.checkAssignUserToGroupAccess({ permissions: ['manage:users'] }, [3])).toBe(true)
  })

  it('allows group managers to assign administrative groups without system access', async () => {
    groups = [{ permissions: ['manage:users'] }]
    expect(await auth.checkAssignUserToGroupAccess({ permissions: ['manage:groups'] }, [3])).toBe(true)
  })

  it('allows system administrators to assign system groups', async () => {
    expect(await auth.checkAssignUserToGroupAccess({ permissions: ['manage:system'] }, [1])).toBe(true)
  })

  it.each([1, 2])('protects system account %i from delegated user managers', async id => {
    target.id = id
    expect(await auth.checkManageUserTargetAccess({ permissions: ['manage:users'] }, id)).toBe(false)
  })

  it('prevents user managers from modifying a system administrator', async () => {
    target.getGlobalPermissions = () => ['manage:system']
    expect(await auth.checkManageUserTargetAccess({ permissions: ['manage:users'] }, target.id)).toBe(false)
  })

  it('prevents user managers from modifying another administrative account', async () => {
    target.getGlobalPermissions = () => ['manage:users']
    expect(await auth.checkManageUserTargetAccess({ permissions: ['manage:users'] }, target.id)).toBe(false)
  })

  it('allows user managers to modify an ordinary user', async () => {
    expect(await auth.checkManageUserTargetAccess({ permissions: ['manage:users'] }, target.id)).toBe(true)
  })

  it('rejects a missing target account', async () => {
    target = null
    expect(await auth.checkManageUserTargetAccess({ permissions: ['manage:users'] }, 999)).toBe(false)
  })
})
