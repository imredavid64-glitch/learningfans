// Build a discussion reply tree from a flat list of posts (which arrive flat
// over realtime), sorting children by date and hoisting the accepted answer to
// the top of the list so it's seen first.

export interface TreePost {
  id: string;
  parent_id?: string | null;
  created_at: string;
}

export interface PostTree<T extends TreePost> {
  roots: T[];
  children: Map<string, T[]>;
}

export function buildPostTree<T extends TreePost>(
  posts: T[],
  acceptedId: string | null,
): PostTree<T> {
  const children = new Map<string, T[]>();
  const roots: T[] = [];

  for (const p of posts) {
    if (p.parent_id && posts.some((x) => x.id === p.parent_id)) {
      const list = children.get(p.parent_id) ?? [];
      list.push(p);
      children.set(p.parent_id, list);
    } else {
      roots.push(p);
    }
  }

  const byDate = (a: T, b: T) => a.created_at.localeCompare(b.created_at);
  roots.sort(byDate);
  for (const list of children.values()) list.sort(byDate);

  // Hoist the accepted answer to the top of the root list (its own replies
  // follow it), whether it was a top-level reply or nested under a parent.
  if (acceptedId) {
    const accepted = posts.find((p) => p.id === acceptedId);
    if (accepted) {
      const rootIdx = roots.indexOf(accepted);
      if (rootIdx !== -1) {
        roots.splice(rootIdx, 1);
      } else if (accepted.parent_id) {
        const siblings = children.get(accepted.parent_id);
        if (siblings) {
          const siblingIdx = siblings.indexOf(accepted);
          if (siblingIdx !== -1) siblings.splice(siblingIdx, 1);
        }
      }
      roots.unshift(accepted);
    }
  }

  return { roots, children };
}
