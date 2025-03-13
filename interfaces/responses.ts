export interface DefaultResponse {
    isSuccessful: boolean,
    message: string,
    data: any
}

export interface CrossoverResponse {
    isGoldenCross: boolean
    isDeathCross: boolean
}