import { ParcelsWithAccess } from '@dcl/legacy-ecs/dist/decentraland/Types'
import { convertToRGBObject } from './convertToRGBObject'
import { isURL } from 'atomicHelpers/isURL'
import { Avatar, AvatarInfo, IPFSv2, Snapshots } from '@dcl/schemas'
import { backupProfile } from '../generateRandomUserProfile'
import { genericAvatarSnapshots } from 'config'
import { calculateDisplayName } from './processServerProfile'
import { NewProfileForRenderer } from './types'
import { Color3 } from 'decentraland-ecs'

export function profileToRendererFormat(
  profile: Partial<Avatar>,
  options: {
    address?: string

    // TODO: there is no explaination why the profile has the parcels of Builder. Remove it from here
    parcels?: ParcelsWithAccess

    // TODO: when profiles are federated, we must change this to accept the profile's
    //       home server
    baseUrl: string
  }
): NewProfileForRenderer {
  const stage = { ...backupProfile(profile.userId || options.address || 'noeth'), ...profile }

  return {
    ...stage,
    userId: stage.userId.toLowerCase(),
    name: calculateDisplayName(stage),
    description: stage.description || '',
    version: stage.version || -1,
    ethAddress: (stage.ethAddress || options.address || '0x0000000000000000000000000000000000000000').toLowerCase(),
    blocked: stage.blocked || [],
    muted: stage.muted || [],
    inventory: [],
    created_at: 0,
    updated_at: 0,
    // @deprecated
    email: '',
    hasConnectedWeb3: stage.hasConnectedWeb3 || false,
    hasClaimedName: stage.hasClaimedName ?? false,
    tutorialFlagsMask: 0,
    tutorialStep: stage.tutorialStep || 0,
    snapshots: prepareSnapshots(profile.avatar!.snapshots),
    avatar: prepareAvatar(profile.avatar),
    baseUrl: options.baseUrl,
    parcelsWithAccess: options.parcels || []
  }
}

export function defaultProfile({
  userId,
  name,
  face256
}: {
  userId: string
  name: string
  face256: string
}): NewProfileForRenderer {
  const avatar = {
    userId,
    ethAddress: userId,
    name,
    avatar: {
      snapshots: prepareSnapshots({ face256, body: '' }),
      ...defaultAvatar()
    }
  }
  return profileToRendererFormat(avatar, { baseUrl: '' })
}

function defaultAvatar(): Omit<AvatarInfo, 'snapshots'> {
  return {
    bodyShape: '',
    eyes: { color: Color3.White() },
    hair: { color: Color3.White() },
    skin: { color: Color3.White() },
    wearables: []
  }
}

function prepareAvatar(avatar?: Partial<AvatarInfo>) {
  return {
    wearables: avatar?.wearables || [],
    emotes: avatar?.emotes || [],
    bodyShape: avatar?.bodyShape || '',
    eyeColor: convertToRGBObject(avatar?.eyes?.color),
    hairColor: convertToRGBObject(avatar?.hair?.color),
    skinColor: convertToRGBObject(avatar?.skin?.color)
  }
}

// Ensure all snapshots are URLs
function prepareSnapshots({ face256, body }: Snapshots): NewProfileForRenderer['snapshots'] {
  // TODO: move this logic to unity-renderer
  function prepare(value: string) {
    if (value === null || value === undefined) {
      return null
    }
    if (
      value === '' ||
      isURL(value) ||
      value.startsWith('/images') ||
      value.startsWith('Qm') ||
      IPFSv2.validate(value)
    ) {
      return value
    }

    return 'data:text/plain;base64,' + value
  }

  const x = prepare(face256)
  return { body: prepare(body) || genericAvatarSnapshots.body, face256: x || genericAvatarSnapshots.face256 }
}
