import * as pull from 'pull-stream'
import { MetaType } from './'

export enum CommandType {
  OpenChannel = 0,
  OpenPlex = 1,
  Meta = 2,
  ChannelData = 3,
  PlexData = 4,
  // ask peer to close source part
  ChannelSinkEnd = 5,
  // ask peer to close source and sink parts
  ChannelSourceAbort = 6,
  PlexEnd = 7,
}

export enum EventIndex {
  EventType = 0,
  Name,
  Payload,
}

export type PlexEvent = [CommandType, string, any, any?]

export function OpenChannel(id: string, name: string, opts?: any): PlexEvent {
  return [CommandType.OpenChannel, id, name, opts]
}

export function OpenPlex(name: string, meta: MetaType): PlexEvent {
  return [CommandType.OpenPlex, name, meta]
}

export function Meta(meta: any): PlexEvent {
  return [CommandType.Meta, '__meta__', meta]
}

export function ChannelData(id: string, data: any): PlexEvent {
  return [CommandType.ChannelData, id, data]
}

export function PlexData(name: string, data: any): PlexEvent {
  return [CommandType.PlexData, name, data]
}

export function ChannelSinkEnd(id: string, endOrError: pull.EndOrError): PlexEvent {
  return [CommandType.ChannelSinkEnd, id, endOrError]
}

export function ChannelSourceAbort(id: string, endOrError: pull.EndOrError): PlexEvent {
  return [CommandType.ChannelSourceAbort, id, endOrError]
}

export function PlexEnd(name: string, endOrError: pull.EndOrError): PlexEvent {
  return [CommandType.PlexEnd, name, endOrError]
}
