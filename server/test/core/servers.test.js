jest.mock('apollo-server-express', () => ({ ApolloServer: jest.fn() }))
jest.mock('../../graph', () => ({}))

const { generateKeyPairSync } = require('crypto')
const jwt = require('jsonwebtoken')
const { ApolloServer } = require('apollo-server-express')
const servers = require('../../core/servers')

describe('core/servers GraphQL subscription authentication', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  let onConnect

  const signToken = (permissions, options = {}) => jwt.sign({ permissions }, privateKey, {
    algorithm: 'RS256',
    audience: 'urn:wiki.test',
    issuer: 'urn:wiki.js',
    expiresIn: '5m',
    ...options
  })

  beforeEach(async () => {
    global.WIKI = {
      config: {
        certs: { public: publicKey },
        auth: { audience: 'urn:wiki.test' }
      },
      app: {}
    }
    ApolloServer.mockClear()
    ApolloServer.mockImplementation(() => ({ applyMiddleware: jest.fn() }))
    await servers.startGraphQL()
    onConnect = ApolloServer.mock.calls[0][0].subscriptions.onConnect
  })

  afterEach(() => {
    delete global.WIKI
  })

  it('rejects anonymous connections', () => {
    expect(() => onConnect({}, {})).toThrow('Unauthorized')
  })

  it('rejects malformed tokens', () => {
    expect(() => onConnect({ token: 'invalid' }, {})).toThrow('Unauthorized')
  })

  it('rejects a valid token without system administration permission', () => {
    expect(() => onConnect({ token: signToken(['read:pages']) }, {})).toThrow('Unauthorized')
  })

  it('rejects an expired administrator token', () => {
    const token = signToken(['manage:system'], { expiresIn: -1 })
    expect(() => onConnect({ token }, {})).toThrow('Unauthorized')
  })

  it('rejects an administrator token issued for another audience', () => {
    const token = signToken(['manage:system'], { audience: 'urn:another-wiki' })
    expect(() => onConnect({ token }, {})).toThrow('Unauthorized')
  })

  it('accepts an administrator token supplied in connection parameters', () => {
    const result = onConnect({ token: signToken(['manage:system']) }, {})
    expect(result.user.permissions).toEqual(['manage:system'])
  })

  it('accepts an administrator token supplied in the upgrade cookie', () => {
    const webSocket = { upgradeReq: { headers: { cookie: `jwt=${signToken(['manage:system'])}` } } }
    expect(onConnect({}, webSocket).user.permissions).toEqual(['manage:system'])
  })
})
