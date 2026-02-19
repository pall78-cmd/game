export interface Message {
  id: number;
  nama: string;
  teks: string;
  created_at: string;
}

export interface FateCard {
  type: 'TRUTH' | 'DARE' | 'WILDCARD' | 'CHOICE' | 'LIGHT' | 'DEEP' | 'CHAOS' | 'FATE';
  content: string;
  invoker: string;
}

export type Layer = 'SECURITY' | 'AGE' | 'NAME' | 'MAIN';

export interface DeckCategory {
  truths: string[];
  dares: string[];
  wildcards: string[];
}

export interface GameDeckState {
  light: DeckCategory;
  deep: DeckCategory;
  chaos: DeckCategory;
}