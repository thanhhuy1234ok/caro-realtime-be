function checkWin(board, x, y, symbol) {
    const directions = [
        [1, 0],   // ngang
        [0, 1],   // dọc
        [1, 1],   // chéo ↘
        [1, -1],  // chéo ↗
    ];

    for (let [dx, dy] of directions) {
        let count = 1;

        for (let dir = -1; dir <= 1; dir += 2) {
            let nx = x + dx * dir;
            let ny = y + dy * dir;

            while (
                nx >= 0 && nx < board[0].length &&
                ny >= 0 && ny < board.length &&
                board[ny][nx] === symbol
            ) {
                count++;
                nx += dx * dir;
                ny += dy * dir;
            }
        }

        if (count >= 5) return true;
    }

    return false;
}

module.exports = { checkWin };
  