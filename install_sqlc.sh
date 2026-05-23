export PATH=$PATH:/usr/local/go/bin
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
echo 'export PATH=$PATH:$(go env GOPATH)/bin' >> ~/.bashrc
export PATH=$PATH:$(go env GOPATH)/bin
sqlc version
