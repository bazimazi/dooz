import { ShadowedElement } from "$/ShadowedElement";
import html from "./GamePage.html?raw";
import css from "./GamePage.css?raw";
import { WinResult } from "$/WinResult";
import { P1, P2 } from "$/players";
import { checkBoard } from "$/check-board";
import { Board } from "./components/board/Board";
import { Header } from "./components/header/Header";


export class GamePage extends ShadowedElement {
    private boardData: any[][] = [[]];
    private result: WinResult | null = null;
    private currentPlayer: string = Math.round(Math.random()) ? P1 : P2;
    private header: Header;
    private board: Board;

    constructor() {
        super(html, css);

        this.header = this.shadowRoot!.querySelector('.header')!;
        this.header.current = this.currentPlayer;
        this.board = this.shadowRoot!.querySelector('.body')!;
        this.board?.addEventListener('cell-click', (e: any) => {
            const { i, j } = e.detail;
            this.handleClick(i, j);
        })
    }

    connectedCallback() {
        this.boardData = Array(3).fill(null).map(() => Array(3).fill(null));
    }

    private handleClick(i: number, j: number) {
        if (this.boardData[i][j] || this.result) return;

        this.boardData[i][j] = this.currentPlayer;
        this.board.data = { i, j, player: this.currentPlayer.toLocaleLowerCase() };
        if (this.checkWinner()) return;

        this.currentPlayer = this.currentPlayer === P1 ? P2 : P1;
        this.header.current = this.currentPlayer;
    };

    private checkWinner() {
        const winResult = checkBoard(this.boardData);
        if (!winResult) return false;

        this.result = winResult;
        // winResult.line.forEach((cell) => {
        //     this.boardData[cell[0]][cell[1]] = "🤩";
        // });
        return true;
    };
}