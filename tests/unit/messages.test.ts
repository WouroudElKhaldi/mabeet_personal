import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import arLb from "../../messages/ar-LB.json";
import en from "../../messages/en.json";

function leaves(tree: object, prefix = ""): Array<[string, unknown]> {
  return Object.entries(tree).flatMap(([key, value]): Array<[string, unknown]> =>
    typeof value === "object" && value !== null
      ? leaves(value, `${prefix}${key}.`)
      : [[`${prefix}${key}`, value]],
  );
}

const paths = (tree: object) =>
  leaves(tree)
    .map(([path]) => path)
    .sort();
const emptyPaths = (tree: object) =>
  leaves(tree)
    .filter(([, value]) => value === "")
    .map(([path]) => path);

describe("translations", () => {
  it("has every English string in Arabic and Lebanese, and nothing extra", () => {
    expect(paths(ar)).toEqual(paths(en));
    expect(paths(arLb)).toEqual(paths(en));
  });

  it("has no empty strings", () => {
    expect(emptyPaths(en)).toEqual([]);
    expect(emptyPaths(ar)).toEqual([]);
    expect(emptyPaths(arLb)).toEqual([]);
  });
});
