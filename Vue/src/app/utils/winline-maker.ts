import { P1, P2 } from "./players";


export function winLineMaker(currentPlayer: string,result?: number[][]) {

    const winLineStyle = {
        bottom: "",
        left: "",
        transform: "",
        height: "",
        backgroundColor: (currentPlayer == P1) ? "#FF99F6" : "#FFD334"
    }

    switch (result?.toString()) {
        case ([[0, 0], [0, 1], [0, 2]]).toString():

            winLineStyle.bottom = "250px";
            winLineStyle.left = "14px";
            winLineStyle.transform = "rotate(90deg)";
            winLineStyle.height = "279px"
            break;

        case ([[1, 0], [1, 1], [1, 2]]).toString():

            winLineStyle.bottom = "154px";
            winLineStyle.left = "14px";
            winLineStyle.transform = "rotate(90deg)";
            winLineStyle.height = "279px"
            break;

        case ([[2, 0], [2, 1], [2, 2]]).toString():

            winLineStyle.bottom = "58px";
            winLineStyle.left = "14px";
            winLineStyle.transform = "rotate(90deg)";
            winLineStyle.height = "279px"
            break;

        case ([[0, 0], [1, 0], [2, 0]]).toString():

            winLineStyle.bottom = "294px";
            winLineStyle.left = "58px";
            winLineStyle.transform = "rotate(180deg)";
            winLineStyle.height = "279px"
            break;

        case ([[0, 1], [1, 1], [2, 1]]).toString():

            winLineStyle.bottom = "294px";
            winLineStyle.left = "152px";
            winLineStyle.transform = "rotate(180deg)";
            winLineStyle.height = "279px"
            break;

        case ([[0, 2], [1, 2], [2, 2]]).toString():

            winLineStyle.bottom = "294px";
            winLineStyle.left = "248px";
            winLineStyle.transform = "rotate(180deg)";
            winLineStyle.height = "279px"
            break;

        case ([[0, 0], [1, 1], [2, 2]]).toString():

            winLineStyle.bottom = "280px";
            winLineStyle.left = "27px";
            winLineStyle.transform = "rotate(135deg)";
            winLineStyle.height = "354px"
            break;

        case ([[0, 2], [1, 1], [2, 0]]).toString():

            winLineStyle.bottom = "280px";
            winLineStyle.left = "280px";
            winLineStyle.transform = "rotate(225deg)";
            winLineStyle.height = "354px"
            break;

        default:
            break;
    }

    return winLineStyle;

}