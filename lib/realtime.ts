import { EventEmitter } from "node:events";

export type TreeRealtimeEvent = {
  type: "tree-changed";
  treeId: string;
  entity: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  at: string;
};

type RealtimeBus = EventEmitter;

declare global {
  var __familyTreeRealtimeBus: RealtimeBus | undefined;
}

function getBus(): RealtimeBus {
  if (!global.__familyTreeRealtimeBus) {
    global.__familyTreeRealtimeBus = new EventEmitter();
  }
  return global.__familyTreeRealtimeBus;
}

export function publishRealtimeEvent(event: TreeRealtimeEvent) {
  getBus().emit("tree-event", event);
}

export function subscribeRealtimeEvent(listener: (event: TreeRealtimeEvent) => void) {
  const bus = getBus();
  bus.on("tree-event", listener);
  return () => {
    bus.off("tree-event", listener);
  };
}
