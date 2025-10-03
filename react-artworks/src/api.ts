export type Artwork = {
    id: number;
    title: string;
    place_of_origin: string | null;
    artist_display: string | null;
    inscriptions: string | null;
    date_start: number | null;
    date_end: number | null;
};

export type ArtworksResponse = {
    data: Artwork[];
    pagination: {
        total: number;
        limit: number;
        offset: number;
        total_pages: number;
        current_page: number;
    };
};

const API_BASE = 'https://api.artic.edu/api/v1';

export async function fetchArtworks(page: number): Promise<ArtworksResponse> {
    const url = `${API_BASE}/artworks?page=${page}`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch artworks: ${res.status}`);
    }
    const json = await res.json();
    // The API returns many fields; map only those we need
    const mapped: Artwork[] = (json.data || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        place_of_origin: item.place_of_origin ?? null,
        artist_display: item.artist_display ?? null,
        inscriptions: item.inscriptions ?? null,
        date_start: item.date_start ?? null,
        date_end: item.date_end ?? null,
    }));
    const pagination = json.pagination ?? {
        total: mapped.length,
        limit: 12,
        offset: 0,
        total_pages: 1,
        current_page: page,
    };
    return { data: mapped, pagination } as ArtworksResponse;
}

