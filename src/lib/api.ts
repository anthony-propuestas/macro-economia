export interface MacroDataPoint {
	year: number;
	value: number;
	country_name: string;
}

export interface ChoroplethEntry {
	country_code: string;
	value: number;
}

export async function fetchCountryData(
	country: string,
	indicator: string
): Promise<MacroDataPoint[]> {
	const res = await fetch(`/api/macro?country=${country}&indicator=${indicator}`);
	if (!res.ok) throw new Error('Error fetching country data');
	const json = await res.json<{ data: MacroDataPoint[] }>();
	return json.data;
}

export async function fetchChoroplethData(indicator: string): Promise<ChoroplethEntry[]> {
	const res = await fetch(`/api/macro?indicator=${indicator}`);
	if (!res.ok) throw new Error('Error fetching choropleth data');
	const json = await res.json<{ data: ChoroplethEntry[] }>();
	return json.data;
}
