"use client";
import { useState } from "react";

type EstadoLetras =
  | "sin_intento"
  | "actual"
  | "correcto"
  | "incorrecto"
  | "pasapalabra";
type LetraRosco = {
  letra: string;
  estado: EstadoLetras;
};
export default function Home() {
  const [letras, setLetras] = useState<LetraRosco[]>(
    [
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
      "I",
      "J",
      "K",
      "L",
      "M",
      "N",
      "Ñ",
      "O",
      "P",
      "Q",
      "R",
      "S",
      "T",
      "U",
      "V",
      "W",
      "X",
      "Y",
      "Z",
    ].map((letra) => {
      if (letra === "A") {
        return { letra, estado: "actual" };
      }
      return { letra, estado: "sin_intento" };
    })
  );
  return (
    <div className="font-sans bg-white items-center justify-items-center min-h-screen p-32">
      <div className="relative bg-white rounded-full w-[400px] h-[400px] flex justify-center items-center mx-auto">
        {letras.map((item, index) => {
          const radio = 270;
          const angulo = (2 * Math.PI * index) / letras.length - Math.PI / 2;
          const x = radio * Math.cos(angulo) + 200 - 20;
          const y = radio * Math.sin(angulo) + 200 - 20; // centrado verticalmente
          return (
            <div
              key={item.letra}
              className={`${
                estadoColor[item.estado]
              } text-white w-10 h-10 flex flex-col justify-center items-center rounded-full absolute`}
              style={{ left: x, top: y }}
            >
              <span>{item.letra}</span>
            </div>
          );
        })}
      </div>
      <button
        className="w-10 h-10 bg-red-500"
        onClick={() => setLetras(pasarActual(letras, "correcto"))}
      >
        Correcto!
      </button>
    </div>
  );
}

const estadoColor: Record<EstadoLetras, string> = {
  correcto: "bg-green-500",
  actual: "bg-orange-500",
  incorrecto: "bg-red-500",
  pasapalabra: "bg-yellow-500",
  sin_intento: "bg-blue-500",
};

function pasarActual(l: LetraRosco[], estado: EstadoLetras) {
  const letras = [...l];
  const indiceLetraActual = letras.findIndex(
    (letra) => letra.estado === "actual"
  );
  letras[indiceLetraActual].estado = estado;

  if (indiceLetraActual === letras.length - 1) {
    letras[0].estado = "actual";
  }
  letras[indiceLetraActual + 1].estado = "actual";
  return letras;
}
