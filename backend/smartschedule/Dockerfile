# Етап 1: Билд
FROM maven:3.8.5-openjdk-17 AS build
WORKDIR /app
COPY . .
RUN mvn clean package -DskipTests

# Етап 2: Стартиране
FROM eclipse-temurin:17-jdk-alpine
WORKDIR /app
# Копираме точно генерирания файл
COPY --from=build /app/target/smartschedule-1.0-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]