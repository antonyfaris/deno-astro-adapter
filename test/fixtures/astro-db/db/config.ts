import { column, defineDb, defineTable } from "astro:db";

const Comment = defineTable({
  columns: {
    author: column.text(),
    body: column.text(),
  },
});

const Number = defineTable({
  columns: {
    id: column.number({ primaryKey: true }),
    number: column.number(),
  },
});

export default defineDb({
  tables: { Comment, Number },
});
