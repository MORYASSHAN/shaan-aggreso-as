// Mongoose plugin: documents can be created and read, never updated or deleted.
const BLOCKED = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'findOneAndReplace',
  'replaceOne',
  'findOneAndDelete',
  'deleteOne',
  'deleteMany',
];

export function insertOnly(schema, { name }) {
  const refuse = () => {
    throw new Error(`${name} is append-only: updates and deletes are not allowed`);
  };
  for (const op of BLOCKED) {
    schema.pre(op, { document: true, query: true }, refuse);
  }
  schema.pre('save', function blockResave() {
    if (!this.isNew) refuse();
  });
  schema.pre('bulkWrite', refuse);
}
