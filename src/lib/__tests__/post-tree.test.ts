import { describe, it, expect } from "vitest";
import { buildPostTree, type TreePost } from "@/lib/post-tree";

type P = TreePost & { body: string };

function post(id: string, createdAt: string, parent_id: string | null = null): P {
  return { id, created_at: createdAt, parent_id, body: id };
}

describe("buildPostTree", () => {
  it("sorts top-level replies by date", () => {
    const tree = buildPostTree(
      [post("b", "2026-08-13T02:00:00Z"), post("a", "2026-08-13T01:00:00Z")],
      null,
    );
    expect(tree.roots.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("groups nested replies under their parent, sorted by date", () => {
    const tree = buildPostTree(
      [
        post("root", "2026-08-13T01:00:00Z"),
        post("kid2", "2026-08-13T03:00:00Z", "root"),
        post("kid1", "2026-08-13T02:00:00Z", "root"),
      ],
      null,
    );
    expect(tree.roots.map((p) => p.id)).toEqual(["root"]);
    expect(tree.children.get("root")!.map((p) => p.id)).toEqual(["kid1", "kid2"]);
  });

  it("hoists an accepted top-level reply to the front", () => {
    const tree = buildPostTree(
      [
        post("a", "2026-08-13T01:00:00Z"),
        post("accepted", "2026-08-13T03:00:00Z"),
        post("b", "2026-08-13T02:00:00Z"),
      ],
      "accepted",
    );
    expect(tree.roots.map((p) => p.id)).toEqual(["accepted", "a", "b"]);
  });

  it("hoists an accepted nested reply out to the top, keeping its children", () => {
    const tree = buildPostTree(
      [
        post("root", "2026-08-13T01:00:00Z"),
        post("accepted", "2026-08-13T02:00:00Z", "root"),
        post("otherKid", "2026-08-13T03:00:00Z", "root"),
        post("grandkid", "2026-08-13T04:00:00Z", "accepted"),
      ],
      "accepted",
    );
    expect(tree.roots.map((p) => p.id)).toEqual(["accepted", "root"]);
    // The accepted reply's own children follow it.
    expect(tree.children.get("accepted")!.map((p) => p.id)).toEqual(["grandkid"]);
    // The parent's remaining children no longer include the hoisted reply.
    expect(tree.children.get("root")!.map((p) => p.id)).toEqual(["otherKid"]);
  });

  it("does nothing when the accepted id is missing or unknown", () => {
    const posts = [post("a", "2026-08-13T01:00:00Z"), post("b", "2026-08-13T02:00:00Z")];
    expect(buildPostTree(posts, null).roots.map((p) => p.id)).toEqual(["a", "b"]);
    expect(buildPostTree(posts, "nope").roots.map((p) => p.id)).toEqual(["a", "b"]);
  });
});
