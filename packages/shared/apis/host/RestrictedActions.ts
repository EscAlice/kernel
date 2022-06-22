import { Vector3, Quaternion } from '@dcl/ecs-math'
import {
  gridToWorld,
  isWorldPositionInsideParcels,
  parseParcelPosition
} from '../../../atomicHelpers/parcelScenePositions'
import { lastPlayerPosition } from '../../world/positionThings'
import { browserInterface } from '../../../unity-interface/BrowserInterface'
import { getUnityInstance } from '../../../unity-interface/IUnityInterface'
import { RpcServerPort } from '@dcl/rpc'
import { PortContext } from './context'
import * as codegen from '@dcl/rpc/dist/codegen'

import {
  MovePlayerToRequest,
  MovePlayerToResponse,
  RestrictedActionsServiceDefinition,
  TriggerEmoteRequest,
  TriggerEmoteResponse
} from '../proto/RestrictedActions.gen'
import { assertHasPermission } from './Permissions'
import { PermissionItem } from '../proto/Permissions.gen'

export async function movePlayerTo(req: MovePlayerToRequest, ctx: PortContext): Promise<MovePlayerToResponse> {
  //   checks permissions
  assertHasPermission(PermissionItem.ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE, ctx)

  if (!ctx.ParcelIdentity) return {}

  const base = parseParcelPosition(
    ctx.ParcelIdentity.isPortableExperience ? '0,0' : ctx.ParcelIdentity.land!.sceneJsonData.scene.base
  )
  const basePosition = new Vector3()
  gridToWorld(base.x, base.y, basePosition)

  // newRelativePosition is the position relative to the scene in meters
  // newAbsolutePosition is the absolute position in the world in meters
  const newAbsolutePosition = basePosition.add(req.newRelativePosition!)

  // validate new position is inside one of the scene's parcels
  if (!isPositionValid(newAbsolutePosition, ctx)) {
    ctx.DevTools.logger.error('Error: Position is out of scene', newAbsolutePosition)
    return {}
  }
  if (!isPositionValid(lastPlayerPosition, ctx)) {
    ctx.DevTools.logger.error('Error: Player is not inside of scene', lastPlayerPosition)
    return {}
  }

  getUnityInstance().Teleport(
    {
      position: newAbsolutePosition,
      cameraTarget: req.cameraTarget ? basePosition.add(req.cameraTarget) : undefined
    },
    false
  )

  // Get ahead of the position report that will be done automatically later and report
  // position right now, also marked as an immediate update (last bool in Position structure)
  browserInterface.ReportPosition({
    position: newAbsolutePosition,
    rotation: Quaternion.Identity,
    immediate: true
  })
  return {}
}

export async function triggerEmote(req: TriggerEmoteRequest, ctx: PortContext): Promise<TriggerEmoteResponse> {
  // checks permissions
  assertHasPermission(PermissionItem.ALLOW_TO_TRIGGER_AVATAR_EMOTE, ctx)

  if (!isPositionValid(lastPlayerPosition, ctx)) {
    ctx.DevTools.logger.error('Error: Player is not inside of scene', lastPlayerPosition)
    return {}
  }

  getUnityInstance().TriggerSelfUserExpression(req.predefinedEmote)
  return {}
}

function isPositionValid(position: Vector3, ctx: PortContext) {
  return (
    ctx.ParcelIdentity!.isPortableExperience ||
    isWorldPositionInsideParcels(ctx.ParcelIdentity.land!.sceneJsonData.scene.parcels, position)
  )
}

export function registerRestrictedActionsServiceServerImplementation(port: RpcServerPort<PortContext>) {
  codegen.registerService(port, RestrictedActionsServiceDefinition, async () => ({
    triggerEmote,
    movePlayerTo
  }))
}