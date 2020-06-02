/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
export interface Transform<T extends LinkedListNode<any>> {
  visitList?(list: LinkedList<T>): void;
  visit?(node: T, list: LinkedList<T>): T;
  finalize?(): void;
}

export interface LinkedListNode<T extends LinkedListNode<any>> {
  next: T|null;
  prev: T|null;
}

export class LinkedList<T extends LinkedListNode<any>> {
  head: T|null = null;
  tail: T|null = null;

  applyTransform(transform: Transform<T>): void {
    if (transform.visitList !== undefined) {
      transform.visitList(this);
    }
    if (transform.visit !== undefined) {
      let node = this.head;
      while (node !== null) {
        node = transform.visit(node, this) as T;

        // Need to ensure:
        // - if node is at the beginning, this.head is updated
        // - if node is at the end, this.tail is updated
        // - node.next.prev is node
        // - node.prev.next is node
        if (node.prev !== null) {
          node.prev.next = node;
        } else {
          this.head = node;
        }

        if (node.next !== null) {
          node.next.prev = node;
        } else {
          this.tail = node;
        }

        node = node.next as T;
      }
    }
    if (transform.finalize !== undefined) {
      transform.finalize();
    }
  }

  prependList(list: LinkedList<T>): void {
    if (list.tail === null || list.head === null) {
      return;
    } else if (this.head === null) {
      this.head = list.head;
      this.tail = list.tail;
      return;
    }

    this.head.prev = list.tail;
    list.tail.next = this.head;
    this.head = list.head;
  }

  /**
   * Sort the nodes from `start` to `end`, using `cmp` to compare.
   *
   * Returns the new `start` and `end` nodes, which are guaranteed to be nodes within the original
   * range.
   *
   * The algorithm in use is an in-place insertion sort.
   */
  sortSubset(start: T, end: T, cmp: (a: T, b: T) => number): {start: T, end: T} {
    if (start === end) {
      return {start, end};
    }

    // Track the new start/end nodes as the sort progresses.
    let tmpStart = start;
    let tmpEnd = start;

    // Temporary assignment - will be overwritten with `start.next` as soon as the loop begins.
    let node = start;
    let next: T = start.next;

    // The single-node special case was handled above, so there is at least one node to process (the
    // end node).
    //
    // This loop body therefore always executes at least once, at which point the while condition
    // will exit the loop if the last node processed was the ending node.
    do {
      // Advance the node to the next one to process, and capture its `next` pointer now since it
      // can change as the sort progresses.
      node = next;
      next = node.next;

      // Remove node from its current position.
      this.remove(node);

      // Look through the already sorted part of the subset (from `tmpStart` up until `next`) and
      // check if the node belongs before any of the previously sorted nodes.
      let inserted = false;
      for (let pos = tmpStart; pos !== next; pos = pos.next) {
        if (cmp(node, pos) < 0) {
          // Yes, the node belongs before `pos`. Insert it there.
          this.insertBefore(pos, node);

          // If `pos` was the beginning, then the current node is now the new beginning.
          if (pos === tmpStart) {
            tmpStart = node;
          }

          inserted = true;
          break;
        }
      }

      // Handle the case where the node didn't fit before any prior nodes.
      if (!inserted) {
        // The node belongs in its original position. How it gets put back there depends on whether
        // it was the tail end of the list or not.
        if (next !== null) {
          this.insertBefore(next, node);
        } else {
          this.append(node);
        }

        // This node is now the tail end of the "sorted" segment.
        tmpEnd = node;
      }
    } while (node !== end);

    // At this point, `tmpStart` and `tmpEnd` are the correct head/tail pointers of the now-sorted
    // segment of the list.
    return {start: tmpStart, end: tmpEnd};
  }

  insertBefore(before: T, insert: T): void {
    if (this.head === before) {
      this.head = insert;
    }

    insert.prev = before.prev;
    insert.next = before;

    if (before.prev !== null) {
      before.prev.next = insert;
    }
    before.prev = insert;
  }

  insertAfter(after: T, insert: T): void {
    if (this.tail === after) {
      this.tail = insert;
    }

    insert.prev = after;
    insert.next = after.next;

    if (after.next !== null) {
      after.next.prev = insert;
    }
    after.next = insert;
  }

  append(node: T): void {
    if (this.tail !== null) {
      node.prev = this.tail;
      this.tail.next = node;
      this.tail = node;
    } else {
      this.head = node;
      this.tail = node;
    }
  }

  remove(node: T): T|null {
    const next = node.next;

    if (this.head === node) {
      this.head = node.next as T;
      if (this.tail === node) {
        this.tail = node.next as T;
      }
    } else if (node.prev !== null) {
      node.prev.next = node.next;
      if (this.tail === node) {
        this.tail = node.prev as T;
      } else if (node.next !== null) {
        node.next.prev = node.prev;
      } else {
        throw new Error('AssertionError: non-tail node has null next pointer');
      }
    } else {
      throw new Error('AssertionError: non-head node has null prev pointer');
    }

    node.prev = null;
    node.next = null;

    return next as T;
  }

  toArray(): T[] {
    const arr: T[] = [];
    this.forEach(node => arr.push(node));
    return arr;
  }

  forEach(cb: (node: T) => any) {
    let node = this.head;
    while (node !== null) {
      cb(node);
      node = node.next as T;
    }
  }

  toString(printer: (node: T) => string): string {
    const strings: string[] = [];
    for (let node = this.head; node !== null; node = node.next) {
      strings.push(printer(node));
    }
    return strings.join('\n');
  }
}
