import * as pull from 'pull-stream'

export enum CommandType {
  Open = 0,
  Data,
  EndOrError,
  Meta,
}

export enum EventIndex {
  EventType = 0,
  Name,
  Payload,
}

export type PlexEvent = [CommandType, string, any]

export function Open(name: string): PlexEvent {
  return [CommandType.Open, name, null]
}

export function Data(name: string, data: any): PlexEvent {
  return [CommandType.Data, name, data]
}

export function EndOrError(name: string, endOrError: pull.EndOrError): PlexEvent {
  return [CommandType.EndOrError, name, endOrError]
}

export function Meta(meta: any): PlexEvent {
  return [CommandType.Meta, '__meta__', meta]
}
