<script lang="ts">
export default {
    props: ['data'],
    emits: ['click']
}
</script>

<template>
    <div class="main">
        <div class="container">
            <div class="row" v-for="(row, i) in data">
                <button type="button" class="cell" v-for="(col, j) in row" @click="() => $emit('click', i, j)">
                    <img v-if="col" :src="`images/${col}.svg`" :alt="col.toString()" />
                </button>
            </div>
        </div>
    </div>
</template>

<style>
.main {
    width: 312px;
    height: 312px;
    border: 1px solid #5570fd;
    backdrop-filter: blur(3px);
    border-radius: 64px;
    padding: 12px;
}

.container {
    display: flex;
    flex-direction: column;
    background-color: #191685;
    border-radius: 56px;
    width: 100%;
    height: 100%;
}

.row {
    display: flex;
}

.cell {
    background: none;
    border: 1px dashed #d9d9d9;
    height: 96px;
    width: 96px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
}

.row:first-child :first-child,
.row:first-child :last-child {
    border: none;
}

.row:last-child :first-child,
.row:last-child :last-child {
    border: none;
}

.row:first-child :nth-child(2),
.row:last-child :nth-child(2) {
    border-top: none;
    border-bottom: none;
}

.row:nth-child(2) :first-child,
.row:nth-child(2) :last-child {
    border-left: none;
    border-right: none;
}
</style>
