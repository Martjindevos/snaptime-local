const net = require('net')

interface TeamSpeakConfig {
  enabled: boolean
  host: string
  clientPort: number // voice port, used for the ts3server:// join link (default 9987)
  queryPort: number // ServerQuery port (default 10011)
  queryUser: string
  queryPassword: string
  serverId: number // virtual server id (default 1)
}

function escapeTsArg(value: string): string {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\//g, '\\/')
    .replace(/ /g, '\\s')
    .replace(/\|/g, '\\p')
}

// Minimal TS3 ServerQuery client: enough to log in, select a virtual server,
// and find-or-create a channel by name. Not a general-purpose query library.
class ServerQueryClient {
  private socket: any
  private buffer = ''
  private pending: { resolve: (lines: string[]) => void; reject: (err: Error) => void } | null = null

  connect(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection({ host, port }, () => {
        // Wait for the "TS3" welcome banner before sending commands
      })
      this.socket.setEncoding('utf8')
      this.socket.once('error', (err: Error) => reject(err))
      this.socket.on('data', (chunk: string) => this.onData(chunk))

      let welcomed = false
      const welcomeCheck = (chunk: string) => {
        if (!welcomed && chunk.includes('TS3')) {
          welcomed = true
          this.socket.removeListener('data', welcomeCheck)
          resolve()
        }
      }
      this.socket.on('data', welcomeCheck)
    })
  }

  private onData(chunk: string) {
    this.buffer += chunk
    if (!this.pending) return

    const lines = this.buffer.split('\n\r').filter((l) => l.trim().length > 0)
    const lastLine = lines[lines.length - 1] || ''
    if (lastLine.startsWith('error ')) {
      this.buffer = ''
      const { resolve, reject } = this.pending
      this.pending = null
      if (lastLine.startsWith('error id=0')) {
        resolve(lines.slice(0, -1))
      } else {
        reject(new Error(lastLine))
      }
    }
  }

  command(cmd: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject }
      this.socket.write(cmd + '\n')
    })
  }

  async login(user: string, password: string): Promise<void> {
    await this.command(`login client_login_name=${escapeTsArg(user)} client_login_password=${escapeTsArg(password)}`)
  }

  async useServer(serverId: number): Promise<void> {
    await this.command(`use sid=${serverId}`)
  }

  // Returns the channel id for `name`, creating it under the root if it doesn't exist yet.
  async ensureChannel(name: string): Promise<string> {
    try {
      const lines = await this.command(`channelfind pattern=${escapeTsArg(name)}`)
      const match = lines[0]?.match(/cid=(\d+)/)
      if (match) return match[1]
    } catch (e) {
      // channelfind returns error 768 (empty result) when nothing matches - fall through to create
    }

    const created = await this.command(`channelcreate channel_name=${escapeTsArg(name)} cpid=0`)
    const match = created[0]?.match(/cid=(\d+)/)
    if (!match) throw new Error('Channel created but no cid returned')
    return match[1]
  }

  close() {
    try {
      this.socket.end()
    } catch (e) {
      // ignore
    }
  }
}

// Ensures a channel matching `locationName` exists on the configured TeamSpeak
// server. Does not touch any already-connected client; joining happens
// separately via joinViaClientUri.
async function ensureLocationChannel(config: TeamSpeakConfig, locationName: string): Promise<{ success: boolean; channelId?: string; error?: string }> {
  if (!config.enabled) return { success: false, error: 'TeamSpeak not enabled' }

  const client = new ServerQueryClient()
  try {
    await client.connect(config.host, config.queryPort)
    await client.login(config.queryUser, config.queryPassword)
    await client.useServer(config.serverId)
    const channelId = await client.ensureChannel(locationName)
    return { success: true, channelId }
  } catch (error) {
    return { success: false, error: String(error) }
  } finally {
    client.close()
  }
}

// Opens the local TeamSpeak client and has it connect + join the named channel.
// Uses the standard ts3server:// URI handler - no ClientQuery auth needed for this step.
function joinViaClientUri(config: TeamSpeakConfig, channelName: string) {
  const { shell } = require('electron')
  const uri = `ts3server://${config.host}?port=${config.clientPort}&channel=${encodeURIComponent(channelName)}`
  shell.openExternal(uri)
}

export { ensureLocationChannel, joinViaClientUri, TeamSpeakConfig }
