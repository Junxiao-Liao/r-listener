import { getContext, setContext } from 'svelte';
import type { Player } from './player.svelte';

const PLAYER_KEY = Symbol('player');

export function setPlayerContext(player: Player) {
	setContext(PLAYER_KEY, player);
}

export function getPlayer(): Player {
	const player = getContext<Player>(PLAYER_KEY);
	if (!player) {
		throw new Error('Player context not initialized. Wrap your tree with the app layout.');
	}
	return player;
}
