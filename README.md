# 사진 한판

산후조리원이나 가족 사진 인화 상황에서 여러 장의 사진을 한 장의 인화지에 배치해 저장하는 정적 웹 앱입니다. 사진은 서버로 업로드되지 않고 브라우저 안에서만 처리됩니다.

## 주요 기능

- 여러 로컬 사진 업로드
- 4x6 세로, 4x6 가로, 5x7 세로, A4 세로, A4 가로 용지 프리셋
- 1컷, 2컷 좌우, 2컷 상하, 4분할, 3단 스트립, 6분할 레이아웃
- 칸별 사진 지정, 드래그 이동, 확대, 90도 회전, 초기화
- 선택 칸의 사진 순서 앞으로/뒤로 이동
- 바깥 여백과 사진 사이 간격 조절
- 둥근 모서리, 배경색, 빈 칸 자동 반복 옵션
- 300 DPI 기준 PNG/JPEG 저장
- localStorage 자동 저장과 샘플 이미지 생성

## 개발

```bash
npm install
npm run dev
```

빌드 확인:

```bash
npm run build
```

정적 산출물은 `dist/`에 생성됩니다.

## GitHub Pages 배포

이 저장소 이름이 `photo-sheet`이므로 Vite `base`는 `/photo-sheet/`로 설정되어 있습니다. GitHub Pages에서 배포할 때는 저장소 Settings의 Pages 항목에서 Source를 `GitHub Actions`로 선택합니다.

`main` 브랜치에 push하면 `.github/workflows/deploy.yml`이 다음 순서로 배포합니다.

1. `npm ci`
2. `npm run build`
3. `dist/`를 GitHub Pages artifact로 업로드
4. Pages에 배포

## 사용 메모

- 공용 PC에서는 출력 후 `작업 지우기`를 눌러 브라우저 저장 데이터를 삭제하세요.
- 프린터 설정에서 선택한 용지 크기와 실제 크기 100%를 맞추면 사진 잘림을 줄일 수 있습니다.
- localStorage에는 업로드한 사진의 data URL이 저장됩니다. 브라우저 저장 공간이 부족하면 사진 수를 줄여야 자동 저장이 다시 동작합니다.
