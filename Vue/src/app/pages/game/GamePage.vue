<script lang="ts">
import { P1, P2 } from "../../utils/players";
import Header from "./Header.vue";
import Footer from "./Footer.vue";
import Board from "./Board.vue";
import { checkBoard } from "../../utils/check-board";

const INITIAL_BOARD = Array(3).fill(null).map(() => Array(3).fill(null));

export default {
    components: {
        Header, Board, Footer
    },
    data() {
        return {
            currentPlayer: Math.round(Math.random()) ? P1 : P2,
            boardData: INITIAL_BOARD
        }
    },
    methods: {
        handleClick(i: number, j: number) {
            if (this.boardData[i][j] || result) return;

            this.boardData[i][j] = this.currentPlayer;
            if (checkWinner(this.boardData, this.currentPlayer)) return;

            this.currentPlayer = this.currentPlayer === P1 ? P2 : P1;
        }
    }
}

const checkWinner = (boardData: string[][], currentPlayer: string) => {
    const winResult = checkBoard(boardData, currentPlayer);
    if (!winResult) return false;

    result = winResult;
    return true;
}

let result: number[][] | null = null;

</script>

<template>
    <div class="page">
        <div class="header">
            <Header :currentPlayer=currentPlayer />
        </div>

        <div class="body">
            <Board :data=boardData @click=handleClick />
        </div>

        <div class="footer">
            <Footer />
        </div>
    </div>
</template>

<style scoped>
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
