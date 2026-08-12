import { GlobalSearch } from "@/components/search/global-search";

export default function SearchPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Search</h1>
        <p className="text-muted-foreground">
          Find spaces, discussions, materials, and people across everything you can access.
        </p>
      </div>
      <GlobalSearch />
    </div>
  );
}
