import random
import numpy as np

GRID_SIZE = 50
EMPTY = 0
TREE = 1
BURNING_1 = 2  # first tick of burning
BURNING_2 = 3  # second tick of burning (will become empty next step)

DIRECTION_OFFSETS = {
    "N": (-1, 0),
    "S": (1, 0),
    "E": (0, 1),
    "W": (0, -1),
}

NEIGHBORS = [(-1, 0), (1, 0), (0, -1), (0, 1)]


class FireSimulation:
    def __init__(self, seed: int = 42):
        self.rng = random.Random(seed)
        self.grid = np.full((GRID_SIZE, GRID_SIZE), TREE, dtype=int)
        center = GRID_SIZE // 2
        self.grid[center, center] = BURNING_1
        self.wind_direction = "N"
        self.wind_speed = 10
        self.step_count = 0

    def set_wind(self, direction: str, speed: float):
        self.wind_direction = direction
        self.wind_speed = speed

    def _spread_probability(self, dr: int, dc: int) -> float:
        base_prob = 0.45
        wind_bonus = 0.0

        wind_offset = DIRECTION_OFFSETS.get(self.wind_direction, (0, 0))
        if (dr, dc) == wind_offset:
            wind_bonus = min(self.wind_speed / 40.0, 0.5)
        elif (dr, dc) == (-wind_offset[0], -wind_offset[1]):
            wind_bonus = -0.15

        return max(0.1, min(0.95, base_prob + wind_bonus))

    def step_simulation(self) -> dict:
        self.step_count += 1
        new_grid = self.grid.copy()

        # BURNING_2 cells become EMPTY (ash)
        new_grid[self.grid == BURNING_2] = EMPTY

        # BURNING_1 cells advance to BURNING_2
        new_grid[self.grid == BURNING_1] = BURNING_2

        # Spread from any burning cell to neighboring trees
        burning_mask = (self.grid == BURNING_1) | (self.grid == BURNING_2)
        burning_positions = list(zip(*np.where(burning_mask)))

        for r, c in burning_positions:
            for dr, dc in NEIGHBORS:
                nr, nc = r + dr, c + dc
                if 0 <= nr < GRID_SIZE and 0 <= nc < GRID_SIZE:
                    if self.grid[nr, nc] == TREE:
                        prob = self._spread_probability(dr, dc)
                        if self.rng.random() < prob:
                            new_grid[nr, nc] = BURNING_1

        self.grid = new_grid

        burning_cells = [
            [int(c), int(r)]
            for r, c in zip(*np.where((self.grid == BURNING_1) | (self.grid == BURNING_2)))
        ]

        perimeter = self._compute_perimeter(burning_cells)

        return {
            "burning_cells": burning_cells,
            "perimeter_polygon": perimeter,
            "total_burning": len(burning_cells),
            "total_burned": int(np.sum(self.grid == EMPTY)),
            "step": self.step_count,
        }

    def _compute_perimeter(self, burning_cells: list) -> list:
        if not burning_cells:
            return []

        xs = [c[0] for c in burning_cells]
        ys = [c[1] for c in burning_cells]

        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)

        top = []
        bottom = []
        for x in range(min_x, max_x + 1):
            ys_at_x = [c[1] for c in burning_cells if c[0] == x]
            if ys_at_x:
                top.append([x, min(ys_at_x)])
                bottom.append([x, max(ys_at_x)])

        bottom.reverse()
        perimeter = top + bottom

        if perimeter and perimeter[0] != perimeter[-1]:
            perimeter.append(perimeter[0])

        return perimeter
