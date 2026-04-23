# Getting Started

### Reference Documentation

For further reference, please consider the following sections:

* [Official Gradle documentation](https://docs.gradle.org)
* [Spring Boot Gradle Plugin Reference Guide](https://docs.spring.io/spring-boot/4.0.5/gradle-plugin)
* [Create an OCI image](https://docs.spring.io/spring-boot/4.0.5/gradle-plugin/packaging-oci-image.html)

### Additional Links

These additional references should also help you:

* [Gradle Build Scans – insights for your project's build](https://scans.gradle.com#gradle)

## 성지 데이터 적재

공공데이터 기반 촬영지 15,034건과 작품 1,025건은 `data/spot_data.sql`에 미리
덤프되어 있다. 개발 DB에 한 번 임포트해서 사용한다:

```bash
mariadb -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < data/spot_data.sql
```

- 원본 CSV: `data/spot_data.csv` (CP949, 공공데이터)
- 재생성: `python3 scripts/gen_spot_sql.py` (CSV가 갱신되면 SQL도 다시 생성)
- `work` 레코드는 id 1000번대부터 사용해 `data.sql`의 손수 시드(id 1~4)와 공존한다.
- `place`는 AUTO_INCREMENT로 들어가므로 중복 임포트 방지는 운영 쪽 책임이다.
  완전히 다시 적재해야 한다면 `TRUNCATE place; TRUNCATE work;` 후 `data/spot_data.sql`을
  다시 실행한다.
