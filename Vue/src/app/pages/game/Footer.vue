<template>
    <a class="refresh" href="/game">
        <img src="images/refresh.svg" alt="refresh" />
    </a>

    <a class="home" href="/">
        <img src="images/home.svg" alt="home" />
    </a>
</template>

<style scoped>
.refresh,
.home {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 48px;
    height: 48px;
    background: linear-gradient(173.14deg,
            rgba(73, 93, 228, 0.32) -6.21%,
            rgba(73, 93, 228, 0.76) 13.35%,
            rgba(73, 93, 228, 0.46) 112.64%);
    border-radius: 16px;
    border: 1px solid #5570fd;
    cursor: pointer;
}
</style>
