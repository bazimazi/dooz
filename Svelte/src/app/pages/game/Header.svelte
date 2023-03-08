<script>
    import { P1, P2 } from "../../utils/players";

    export let currentPlayer;
</script>

<div class={`player1 ${currentPlayer === P1 ? "current" : ""}`}>
    <img
        src="images/current_1.svg"
        alt="Player 1 Turn"
        class="current-img"
    />
    <div class="player-container">
        <img src="images/player.svg" alt="Player 1" />
        <div class="player-title">Player 1</div>
        <img src="images/player1.svg" alt="X" />
    </div>
</div>

<div class="vs">VS</div>

<div class={`player2 ${currentPlayer === P2 ? "current" : ""}`}>
    <img
        src="images/current_2.svg"
        alt="Player 2 Turn"
        class="current-img"
    />
    <div class="player-container">
        <img src="images/player.svg" alt="Player 2" />
        <div class="player-title">Player 2</div>
        <img src="images/player2.svg" alt="O" />
    </div>
</div>

<style lang="scss">
    .vs {
        font-weight: 400;
        font-size: 32px;
    }

    .player1,
    .player2 {
        position: relative;
        width: 98px;
        height: 130px;
        padding: 4px;
        border: 1px solid #5570fd;
        border-radius: 24px;

        &.current {
            .current-img {
                display: block;
            }
        }
    }

    .player1.current {
        border-color: #f3339e;
    }

    .player2.current {
        border-color: #f9bd13;
    }

    .player-container {
        display: flex;
        flex-direction: column;
        justify-content: space-around;
        align-items: center;
        width: 100%;
        height: 100%;
        font-weight: 400;
        font-size: 16px;
        background-color: #5570fd;
        border-radius: 20px;

        img {
            max-width: 48px;
        }
    }

    .current-img {
        max-width: 14px;
        position: absolute;
        bottom: -15px;
        left: 40px;
        display: none;
    }
</style>
