<script context="module">
    const INITIAL_BOARD = Array(3)
        .fill(null)
        .map(() => Array(3).fill(null));
</script>

<script lang="ts">
    import { P1, P2 } from "../../utils/players";

    import Header from "./Header.svelte";
    import Footer from "./Footer.svelte";
    import { checkBoard } from "../../utils/check-board";
    import Board from "./Board.svelte";

    let boardData = INITIAL_BOARD;
    let currentPlayer = Math.round(Math.random()) ? P1 : P2;
    let result: number[][] | null = null;

    const handleClick = (i: number, j: number) => {
        if (boardData[i][j] || result) return;

        boardData[i][j] = currentPlayer;
        boardData = boardData;
        if (checkWinner()) return;

        currentPlayer = currentPlayer === P1 ? P2 : P1;
    };

    const checkWinner = () => {
        const winResult = checkBoard(boardData, currentPlayer);
        if (!winResult) return false;

        result = winResult;
        return true;
    };
</script>

<div class="page">
    <div class="header">
        <Header currentPlayer={P1} />
    </div>

    <div class="body">
        <Board data={boardData} onClick={handleClick} />
    </div>

    <div class="footer">
        <Footer />
    </div>
</div>

<style>
    .page {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        height: 100%;
        background-image: url("images/game-page_bg.svg");
        background-size: 100% 100%;
        background-repeat: no-repeat;
    }

    .header {
        display: flex;
        gap: 16px;
        margin-top: 36px;
        align-items: center;
        font-family: Arial, Helvetica, sans-serif;
        color: white;
    }

    .body {
        display: flex;
        justify-content: center;
    }

    .footer {
        margin-bottom: 60px;
        display: flex;
        justify-content: center;
        gap: 32px;
        align-items: center;
    }
</style>
