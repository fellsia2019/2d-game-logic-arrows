import type { Topic } from '../core/types';
import type { Theme } from './theme';

interface TopicPalette {
  surface: string;
  edge: string;
  line: string;
  accent: string;
  badge: string;
  button: string;
  buttonBorder: string;
  buttonText: string;
  hover: string;
}

// One registry by fact-topic slug. Surfaces stay close to the game panels;
// badges, explanation buttons and selection controls carry the topic colour.
export const TOPIC_PALETTES = {
  space: {
    dark: {
      surface: '#3b3458', edge: '#2d334f', line: '#8771ac',
      accent: '#dec9ff', badge: '#514061', button: '#654687',
      buttonBorder: '#b18add', buttonText: '#faf2ff', hover: '#79559e',
    },
    light: {
      surface: '#f5efff', edge: '#eef1ff', line: '#cbb7e8',
      accent: '#67389a', badge: '#e8daf9', button: '#e5d1fb',
      buttonBorder: '#b58ad9', buttonText: '#513078', hover: '#d6b9f4',
    },
  },
  nature: {
    dark: {
      surface: '#27494b', edge: '#29394f', line: '#609e91',
      accent: '#91f1c7', badge: '#25544c', button: '#23604f',
      buttonBorder: '#54c8a2', buttonText: '#e6fff3', hover: '#2e7661',
    },
    light: {
      surface: '#eaf8f1', edge: '#ecf2fa', line: '#97c9b4',
      accent: '#176342', badge: '#d5efdf', button: '#c5e8d5',
      buttonBorder: '#70ab8e', buttonText: '#184c38', hover: '#afdcc4',
    },
  },
  technology: {
    dark: {
      surface: '#27475d', edge: '#293851', line: '#628daf',
      accent: '#96deff', badge: '#24526a', button: '#255779',
      buttonBorder: '#64bdf0', buttonText: '#ecf8ff', hover: '#306d94',
    },
    light: {
      surface: '#eaf5ff', edge: '#edf0fb', line: '#9fbee0',
      accent: '#195d86', badge: '#d5e9f9', button: '#c6e3f8',
      buttonBorder: '#79acd2', buttonText: '#234f73', hover: '#acd5f1',
    },
  },
  art: {
    dark: {
      surface: '#513648', edge: '#35334f', line: '#b07991',
      accent: '#ffc0b1', badge: '#643e50', button: '#774559',
      buttonBorder: '#efa697', buttonText: '#fff2ec', hover: '#91566b',
    },
    light: {
      surface: '#fff0ec', edge: '#f5effa', line: '#deb2ba',
      accent: '#93415a', badge: '#f7dce1', button: '#f7d2d6',
      buttonBorder: '#d890a4', buttonText: '#78334d', hover: '#f1bdc5',
    },
  },
} as const satisfies Record<Topic, Record<Theme, TopicPalette>>;

// Both variants are emitted so CSS can follow device theme changes immediately,
// as well as the explicit theme switch in the local debug tools.
export function topicPaletteAttributes(topic: Topic): string {
  const variables = Object.entries(TOPIC_PALETTES[topic]).flatMap(([theme, palette]) =>
    Object.entries(palette).map(([token, colour]) =>
      `--topic-${theme}-${token.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}:${colour}`));
  return `data-topic-palette="${topic}" style="${variables.join(';')}"`;
}
