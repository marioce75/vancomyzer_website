import test from "node:test";
import assert from "node:assert/strict";
import { accessAcknowledgementsEnabled } from "./configuration";

test("acknowledgement availability fails closed and follows the current server switch", () => {
  const previous = process.env.ACCESS_REQUEST_ACK_ENABLED;
  try {
    for (const value of [undefined, "", "false", "TRUE", "1", "true", "false"]) {
      if (value === undefined) delete process.env.ACCESS_REQUEST_ACK_ENABLED;
      else process.env.ACCESS_REQUEST_ACK_ENABLED = value;
      assert.equal(accessAcknowledgementsEnabled(), value === "true");
    }
  } finally {
    if (previous === undefined) delete process.env.ACCESS_REQUEST_ACK_ENABLED;
    else process.env.ACCESS_REQUEST_ACK_ENABLED = previous;
  }
});
