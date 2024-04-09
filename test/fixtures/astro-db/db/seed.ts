import { db, Comment } from "astro:db";

export default async function () {
  await db.insert(Comment).values([
    { author: "John", body: "Hello!" },
    { author: "Jane", body: "Hi!" },
  ]);
}
