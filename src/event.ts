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

export type PlexEvent = [CommandType, string, any]

export function OpenChannel(name: string): PlexEvent {
  return [CommandType.OpenChannel, name, null]
}

export function OpenPlex(name: string, meta: MetaType): PlexEvent {
  return [CommandType.OpenPlex, name, meta]
}

export function Meta(meta: any): PlexEvent {
  return [CommandType.Meta, '__meta__', meta]
}

export function ChannelData(name: string, data: any): PlexEvent {
  return [CommandType.ChannelData, name, data]
}

export function PlexData(name: string, data: any): PlexEvent {
  return [CommandType.PlexData, name, data]
}

export function ChannelSinkEnd(name: string, endOrError: pull.EndOrError): PlexEvent {
  return [CommandType.ChannelSinkEnd, name, endOrError]
}

export function ChannelSourceAbort(name: string, endOrError: pull.EndOrError): PlexEvent {
  return [CommandType.ChannelSourceAbort, name, endOrError]
}

export function PlexEnd(name: string, endOrError: pull.EndOrError): PlexEvent {
  return [CommandType.PlexEnd, name, endOrError]
}
