@Library('podTemplateLib')

import net.santiment.utils.podTemplates

properties([
  buildDiscarder(
    logRotator(
      artifactDaysToKeepStr: '30',
      artifactNumToKeepStr: '',
      daysToKeepStr: '30',
      numToKeepStr: ''
    )
  )
])

slaveTemplates = new podTemplates()

slaveTemplates.dockerComposeTemplate { label ->
  node(label) {
    container('docker-compose') {
      def scmVars = checkout scm

      stage('Run tests') {
        sh "./bin/test.sh"
      }

      stage('Build image') {
        withCredentials([string(credentialsId: 'aws_account_id', variable: 'aws_account_id')]) {
          def awsRegistry = "${env.aws_account_id}.dkr.ecr.eu-central-1.amazonaws.com"

          docker.withRegistry("https://${awsRegistry}", "ecr:eu-central-1:ecr-credentials") {
            sh "docker build \
              -t ${awsRegistry}/erc20-transfers-exporter:${env.BRANCH_NAME} \
              -t ${awsRegistry}/erc20-transfers-exporter:${scmVars.GIT_COMMIT} \
              -f docker/Dockerfile ."
            sh "docker push ${awsRegistry}/erc20-transfers-exporter:${env.BRANCH_NAME}"
            sh "docker push ${awsRegistry}/erc20-transfers-exporter:${scmVars.GIT_COMMIT}"
          }
        }
      }
    }
  }
}