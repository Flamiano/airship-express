"use client";

type TableInfo = {
  name: string;
  description: string;
  columns: string[];
};

type TableGroup = {
  heading: string;
  tables: TableInfo[];
};

type SupabaseSchemaTableProps = {
  groups: TableGroup[];
};

export default function SupabaseSchemaTable({ groups }: SupabaseSchemaTableProps) {
  return (
    <section className="bg-surface-container-lowest border border-surface-variant rounded-DEFAULT p-6 shadow-[0px_10px_30px_rgba(0,0,0,0.04)]">
      

      <div className="flex flex-col gap-8">
        {groups.map((group) => (
          <div key={group.heading} className="overflow-hidden rounded-DEFAULT border border-surface-variant bg-white">
            <div className="bg-surface-container-high px-4 py-3 border-b border-surface-variant">
              <h3 className="text-label-lg font-semibold text-on-background">{group.heading}</h3>
            </div>
            <div className="divide-y divide-surface-variant">
              {group.tables.map((table) => (
                <div key={table.name} className="px-4 py-5">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-label-md font-semibold text-on-background">{table.name}</p>
                      <p className="text-body-sm text-on-surface-variant">{table.description}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-primary-container px-3 py-1 text-label-sm font-medium text-primary">
                      {table.columns.length} columns
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {table.columns.map((column) => (
                      <div
                        key={column}
                        className="rounded-lg border border-surface-variant bg-surface-container px-3 py-2 text-body-sm text-on-surface"
                      >
                        {column}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
