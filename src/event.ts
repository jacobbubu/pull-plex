import * as pull from 'pull-stream'
import { MetaType } from './'

export enum CommandType {
  OpenChannel = 0,
  OpenPlex,
  Meta,
  ChannelData,
  PlexData,
  // ask peer to close source part
  ChannelSinkEnd,
  // ask peer to close source and sink parts
  ChannelSourceAbort,
  PlexEnd,
}

export enum EventIndex {
  EventType = 0,
  Name,
  Payload,
}

export type PlexEvent = [CommandType, string | number, any]

export function OpenChannel(id: number, name: string): PlexEvent {
  return [CommandType.OpenChannel, id, name]
}

export function OpenPlex(name: string, meta: MetaType): PlexEvent {
  return [CommandType.OpenPlex, name, meta]
}

export function Meta(meta: any): PlexEvent {
  return [CommandType.Meta, '__meta__', meta]
}

export function ChannelData(id: number, data: any): PlexEvent {
  return [CommandType.ChannelData, id, data]
}

export function PlexData(name: string, data: any): PlexEvent {
  return [CommandType.PlexData, name, data]
}

export function ChannelSinkEnd(id: number, endOrError: pull.EndOrError): PlexEvent {
  return [CommandType.ChannelSinkEnd, id, endOrError]
}

export function ChannelSourceAbort(id: number, endOrError: pull.EndOrError): PlexEvent {
  return [CommandType.ChannelSourceAbort, id, endOrError]
}

export function PlexEnd(name: string, endOrError: pull.EndOrError): PlexEvent {
  return [CommandType.PlexEnd, name, endOrError]
}
