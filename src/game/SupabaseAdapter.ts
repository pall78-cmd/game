import { Async } from 'boardgame.io/internal';
import type { SupabaseClient } from '@supabase/supabase-js';

export class SupabaseAdapter extends Async {
    private client: SupabaseClient;
    private tableName: string;

    constructor(client: SupabaseClient, tableName: string = 'boardgame_state') {
        super();
        this.client = client;
        this.tableName = tableName;
    }

    async connect() {
        return;
    }

    async createMatch(matchID: string, opts: any) {
        await this.client.from(this.tableName).insert({
            match_id: matchID,
            initial_state: opts.initialState,
            state: opts.initialState,
            metadata: opts.metadata,
            log: []
        });
    }

    async setMetadata(matchID: string, metadata: any) {
        await this.client.from(this.tableName).update({ metadata }).eq('match_id', matchID);
    }

    async setState(matchID: string, state: any, deltalog?: any[]) {
        const { data } = await this.client.from(this.tableName).select('log').eq('match_id', matchID).single();
        const log = data ? data.log || [] : [];
        if (deltalog && deltalog.length > 0) {
            log.push(...deltalog);
        }
        await this.client.from(this.tableName).update({ state, log }).eq('match_id', matchID);
    }

    async fetch(matchID: string, opts: any) {
        const { data, error } = await this.client.from(this.tableName).select('*').eq('match_id', matchID);
        if (error || !data || data.length === 0) return {};
        const matchData = data[0];

        const result: any = {};
        if (opts.state) result.state = matchData.state;
        if (opts.metadata) result.metadata = matchData.metadata;
        if (opts.log) result.log = matchData.log;
        if (opts.initialState) result.initialState = matchData.initial_state;
        return result;
    }

    async wipe(matchID: string) {
        await this.client.from(this.tableName).delete().eq('match_id', matchID);
    }

    async listMatches(opts?: any) {
        const { data } = await this.client.from(this.tableName).select('match_id');
        if (!data) return [];
        return data.map(r => r.match_id);
    }
}
