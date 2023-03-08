<div class="title">
    <img src="images/title.svg" alt="title" class="title-img" />
    <img
        src="images/title_bg_1.svg"
        alt="title"
        class="title-bg1"
    />
    <img
        src="images/title_bg_2.svg"
        alt="title"
        class="title-bg2"
    />
</div>
<div class="body">
    <a class="paly-now-button" href="game"> Play Now! </a>
    <button class="paly-bot-button">
        <img src="images/bot.svg" alt="bot"/>
        Play with bot
    </button>
    <button class="paly-friends-button">
        <img src="images/friends.svg" alt="friends"/>
        Play with friends
    </button>
</div>

<style>
    .title,
    .body {
        flex-grow: 1;
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
    }
    .title {
        justify-content: center;
        position: relative;
    }

    .title-img {
        width: 170px;
    }

    .title-bg1 {
        position: absolute;
        top: 0;
        left: 22px;
    }

    .title-bg2 {
        position: absolute;
        top: 0;
        right: 0;
    }

    .body {
        gap: 16px;
        background-image: url("static/images/bg.png");
        background-repeat: no-repeat;
        background-size: cover;
    }

    .paly-now-button,
    .paly-bot-button,
    .paly-friends-button {
        width: 265px;
        height: 56px;
        border-radius: 24px;
        background: linear-gradient(#191685, #191685) padding-box,
            linear-gradient(to right, rgba(255, 255, 255, 0.33), #191685)
                border-box;
        border: 1px solid transparent;
        font-weight: 500;
        font-size: 24px;
        color: white;
        cursor: pointer;
        user-select: none;
    }

    .paly-now-button {
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: Arial, Helvetica, sans-serif;
        text-decoration: none;
        margin-bottom: 16px;
        background: linear-gradient(#191685, #191685) padding-box,
            linear-gradient(to right, rgba(255, 255, 255, 0.33), #191685)
                border-box;
    }

    .paly-bot-button,
    .paly-friends-button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        background: linear-gradient(#4b61e9, #4b61e9) padding-box,
            linear-gradient(to right, rgba(255, 255, 255, 0.5), #5570fd)
                border-box;
    }
</style>
