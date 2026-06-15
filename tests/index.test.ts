import { hello } from "../src";

test("returns the expected output", () => {
  expect(hello()).toBe("Hello, world!");
});
