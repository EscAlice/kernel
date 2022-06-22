import { RpcServerPort } from '@dcl/rpc/dist/types'
import * as codegen from '@dcl/rpc/dist/codegen'
import { DevToolsServiceDefinition } from '../proto/DevTools.gen'
import { ProtocolMapping } from 'devtools-protocol/types/protocol-mapping'
import { PortContext } from './context'

export function registerDevToolsServiceServerImplementation(port: RpcServerPort<PortContext>) {
  codegen.registerService(port, DevToolsServiceDefinition, async () => ({
    async event(req, context) {
      const params = JSON.parse(req.jsonPayload)
      switch (req.type) {
        case 'Runtime.consoleAPICalled': {
          const [event] = params as ProtocolMapping.Events['Runtime.consoleAPICalled']

          context.DevTools.logger.log('', ...event.args.map(($) => ('value' in $ ? $.value : $.unserializableValue)))

          break
        }

        case 'Runtime.exceptionThrown': {
          const [payload] = params as ProtocolMapping.Events['Runtime.exceptionThrown']
          context.DevTools.exceptions.set(payload.exceptionDetails.exceptionId, payload.exceptionDetails)

          if (payload.exceptionDetails.exception) {
            context.DevTools.logger.error(
              payload.exceptionDetails.text,
              payload.exceptionDetails.exception.value || payload.exceptionDetails.exception.unserializableValue
            )
          } else {
            context.DevTools.logger.error(payload.exceptionDetails.text)
          }
          break
        }
      }

      return {}
    }
  }))
}