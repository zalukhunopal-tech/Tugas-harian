/** Dimuat sebelum aplikasi (lihat entry.ts): memasang penerjemah fetch dan pengganti dialog. */
import { pasangKonektor } from "./konektor";
import { pasangDialog } from "./dialog";

pasangKonektor();
pasangDialog();
